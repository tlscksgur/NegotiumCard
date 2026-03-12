package com.negotium.card.search.dto;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.person.dto.PersonResponse;

import java.util.List;

public record SearchResultResponse(
    List<PersonResponse> persons,
    List<CompanyResponse> companies,
    List<DepartmentResponse> departments
) {
}
