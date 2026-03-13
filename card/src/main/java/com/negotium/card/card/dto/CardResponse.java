package com.negotium.card.card.dto;

import com.negotium.card.entity.Card;
import com.negotium.card.person.dto.PersonResponse;

import java.time.LocalDateTime;

public record CardResponse(
    Long id,
    String imageUrl,
    String originalFileName,
    String status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    PersonResponse person,
    OcrResultResponse ocrResult
) {

    public static CardResponse from(Card card) {
        return new CardResponse(
            card.getId(),
            card.getImageUrl(),
            card.getOriginalFileName(),
            card.getStatus().name(),
            card.getCreatedAt(),
            card.getUpdatedAt(),
            card.getPerson() != null ? PersonResponse.from(card.getPerson()) : null,
            card.getOcrResult() != null ? OcrResultResponse.from(card.getOcrResult()) : null
        );
    }
}
