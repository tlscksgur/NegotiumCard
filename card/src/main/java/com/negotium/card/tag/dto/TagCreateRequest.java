package com.negotium.card.tag.dto;

import jakarta.validation.constraints.NotBlank;

public record TagCreateRequest(@NotBlank String name) {
}
