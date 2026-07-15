import { prisma } from "@ai-radar/db";
import { requireScanAccess } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n";
import { buildScanReportPdf, pdfFilename } from "@/lib/report-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ brandId: string; scanId: string }> },
) {
  try {
    const { brandId, scanId } = await context.params;
    const access = await requireScanAccess(scanId);
    if (access.scan.brandId !== brandId) {
      return Response.json({ error: "Scan not found" }, { status: 404 });
    }

    const scan = await prisma.scanRun.findUnique({
      where: { id: scanId },
      include: {
        brand: true,
        scoreSnapshot: true,
        recommendations: {
          orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
        },
        promptRuns: {
          orderBy: { createdAt: "asc" },
          include: {
            prompt: true,
            engine: true,
            aiResponse: {
              include: {
                parsedResult: true,
                citations: true,
                mentions: true,
              },
            },
          },
        },
      },
    });

    if (!scan) {
      return Response.json({ error: "Scan not found" }, { status: 404 });
    }

    const locale = await getRequestLocale();
    const pdf = buildScanReportPdf({
      brand: scan.brand,
      scan,
      generatedAt: new Date(),
      locale,
    });
    return pdfResponse(
      pdf,
      pdfFilename(
        scan.brand.name,
        locale === "sl"
          ? `pregled-${scan.id.slice(0, 8)}-porocilo`
          : `scan-${scan.id.slice(0, 8)}-report`,
      ),
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}

function pdfResponse(pdf: Uint8Array, filename: string) {
  return new Response(pdfArrayBuffer(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function pdfArrayBuffer(pdf: Uint8Array) {
  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);
  return body;
}

function reportErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Report failed";
  if (message.startsWith("Unauthorized")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message.includes("not found")) {
    return Response.json({ error: message }, { status: 404 });
  }
  if (message.startsWith("Forbidden")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Scan PDF report failed", error);
  return Response.json({ error: "Report failed" }, { status: 500 });
}
