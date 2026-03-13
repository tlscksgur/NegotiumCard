package com.negotium.card.card.dto;

import com.negotium.card.entity.OcrResult;

public record OcrResultResponse(
    Long id,
    String rawText,
    String name,
    String company,
    String department,
    String position,
    String email,
    String phone
) {

    public static OcrResultResponse from(OcrResult ocrResult) {
        return new OcrResultResponse(
            ocrResult.getId(),
            ocrResult.getRawText(),
            ocrResult.getName(),
            ocrResult.getCompany(),
            ocrResult.getDepartment(),
            ocrResult.getPosition(),
            ocrResult.getEmail(),
            ocrResult.getPhone()
        );
    }
}
