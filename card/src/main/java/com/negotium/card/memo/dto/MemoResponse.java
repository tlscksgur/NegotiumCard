package com.negotium.card.memo.dto;

import com.negotium.card.entity.Memo;

import java.time.LocalDateTime;

public record MemoResponse(
    Long id,
    Long personId,
    Long userId,
    String content,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {

    public static MemoResponse from(Memo memo) {
        return new MemoResponse(
            memo.getId(),
            memo.getPerson().getId(),
            memo.getUser().getId(),
            memo.getContent(),
            memo.getCreatedAt(),
            memo.getUpdatedAt()
        );
    }
}
