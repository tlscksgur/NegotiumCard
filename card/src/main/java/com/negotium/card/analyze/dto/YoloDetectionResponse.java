package com.negotium.card.analyze.dto;

public record YoloDetectionResponse(
    String label,
    double x,
    double y,
    double width,
    double height,
    double confidence
) {
}
