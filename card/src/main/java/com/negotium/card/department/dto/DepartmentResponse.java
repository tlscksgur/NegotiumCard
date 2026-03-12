package com.negotium.card.department.dto;

import com.negotium.card.entity.Department;

public record DepartmentResponse(
    Long id,
    String name,
    Integer depth,
    Long companyId,
    Long parentId
) {

    public static DepartmentResponse from(Department department) {
        return new DepartmentResponse(
            department.getId(),
            department.getName(),
            department.getDepth(),
            department.getCompany() != null ? department.getCompany().getId() : null,
            department.getParent() != null ? department.getParent().getId() : null
        );
    }
}
