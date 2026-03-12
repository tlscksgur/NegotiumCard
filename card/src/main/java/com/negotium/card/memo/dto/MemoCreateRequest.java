package com.negotium.card.memo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MemoCreateRequest(
    @NotNull Long personId,
    @NotBlank String content
) {
}
