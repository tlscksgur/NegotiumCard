package com.negotium.card.tag.dto;

import jakarta.validation.constraints.NotNull;

public record PersonTagCreateRequest(@NotNull Long tagId) {
}
