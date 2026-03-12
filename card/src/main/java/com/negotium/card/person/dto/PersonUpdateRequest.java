package com.negotium.card.person.dto;

import jakarta.validation.constraints.Size;

public record PersonUpdateRequest(
    @Size(max = 100) String name,
    @Size(max = 100) String normalizedName,
    @Size(max = 150) String email,
    @Size(max = 50) String phone,
    Long companyId,
    Long departmentId,
    Long positionId
) {
}
