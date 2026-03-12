package com.negotium.card.person.dto;

import com.negotium.card.entity.Person;

public record PersonResponse(
    Long id,
    String name,
    String normalizedName,
    String email,
    String phone,
    Long companyId,
    String companyName,
    Long departmentId,
    String departmentName,
    Long positionId,
    String positionName
) {

    public static PersonResponse from(Person person) {
        return new PersonResponse(
            person.getId(),
            person.getName(),
            person.getNormalizedName(),
            person.getEmail(),
            person.getPhone(),
            person.getCompany() != null ? person.getCompany().getId() : null,
            person.getCompany() != null ? person.getCompany().getName() : null,
            person.getDepartment() != null ? person.getDepartment().getId() : null,
            person.getDepartment() != null ? person.getDepartment().getName() : null,
            person.getPosition() != null ? person.getPosition().getId() : null,
            person.getPosition() != null ? person.getPosition().getName() : null
        );
    }
}
