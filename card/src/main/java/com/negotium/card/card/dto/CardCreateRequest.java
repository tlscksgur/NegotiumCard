package com.negotium.card.card.dto;

import com.negotium.card.entity.CardStatus;
import jakarta.validation.constraints.NotBlank;

public record CardCreateRequest(
    Long personId,
    @NotBlank String imageUrl,
    String originalFileName,
    CardStatus status
) {
}
