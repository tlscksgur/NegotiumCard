package com.negotium.card.analyze.dto;

import com.negotium.card.card.dto.OcrResultResponse;

public record CardOcrAnalyzeResponse(
    Long cardId,
    String imageUrl,
    String status,
    OcrResultResponse ocrResult
) {
}
