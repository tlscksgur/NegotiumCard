package com.negotium.card.company.dto;

import com.negotium.card.entity.Company;

public record CompanyResponse(
    Long id,
    String name,
    String normalizedName
) {

    public static CompanyResponse from(Company company) {
        return new CompanyResponse(company.getId(), company.getName(), company.getNormalizedName());
    }
}
