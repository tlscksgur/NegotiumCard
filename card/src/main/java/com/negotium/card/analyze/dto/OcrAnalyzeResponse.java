package com.negotium.card.analyze.dto;

public record OcrAnalyzeResponse(
    String imageUrl,
    String rawText,
    String name,
    String company,
    String department,
    String position,
    String email,
    String phone
) {
}
