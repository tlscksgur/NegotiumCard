package com.negotium.card.analyze.dto;

import java.util.List;

public record CardYoloAnalyzeResponse(
    Long cardId,
    String imageUrl,
    String status,
    List<YoloDetectionResponse> detections
) {
}
