package com.negotium.card.analyze.dto;

import java.util.List;

public record YoloAnalyzeResponse(
    String imageUrl,
    List<YoloDetectionResponse> detections
) {
}
