package com.negotium.card.analyze.dto;

import jakarta.validation.constraints.NotBlank;

public record YoloAnalyzeRequest(
    @NotBlank String imageUrl
) {
}
