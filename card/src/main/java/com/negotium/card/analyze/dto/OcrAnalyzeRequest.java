package com.negotium.card.analyze.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record OcrAnalyzeRequest(
    @NotBlank String imageUrl,
    List<YoloDetectionResponse> detections
) {
}
