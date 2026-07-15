import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n";
import {
  buildBrandReportPdf,
  pdfFilename,
  type BrandPdfReportInput,
} from "@/lib/report-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await context.params;
    await requireBrandAccess(brandId);

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        competitors: true,
        scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 8 },
        promptSets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { prompts: { select: { id: true } } },
        },
        scanRuns: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            scoreSnapshot: true,
          },
        },
      },
    });

    if (!brand) {
      return Response.json({ error: "Brand not found" }, { status: 404 });
    }

    const locale = await getRequestLocale();
    const input: BrandPdfReportInput = {
      brand,
      generatedAt: new Date(),
      locale,
      latestScore: brand.scoreSnapshots[0] ?? null,
      scoreHistory: brand.scoreSnapshots,
      competitors: brand.competitors,
      activePromptCount: brand.promptSets[0]?.prompts.length ?? 0,
      latestScans: brand.scanRuns,
    };
    const pdf = buildBrandReportPdf(input);
    return pdfResponse(
      pdf,
      pdfFilename(
        brand.name,
        locale === "sl" ? "porocilo-ai-vidnost" : "ai-visibility-report",
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
  console.error("Brand PDF report failed", error);
  return Response.json({ error: "Report failed" }, { status: 500 });
}
