package com.negotium.card.card.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ManualCardCreateRequest(
    @Size(max = 255) String originalFileName,
    @Size(max = 20000) String rawText,
    @NotBlank @Size(max = 100) String name,
    @NotBlank @Size(max = 255) String company,
    @Size(max = 255) String department,
    @Size(max = 255) String position,
    @Size(max = 150) String email,
    @Size(max = 50) String phone
) {
}
