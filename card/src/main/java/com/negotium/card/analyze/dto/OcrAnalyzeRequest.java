package com.negotium.card.analyze.dto;

import jakarta.validation.constraints.NotBlank;

public record OcrAnalyzeRequest(
    @NotBlank String imageUrl
) {
}
