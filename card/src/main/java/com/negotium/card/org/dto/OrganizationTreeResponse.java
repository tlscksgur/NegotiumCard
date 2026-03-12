package com.negotium.card.org.dto;

import com.negotium.card.person.dto.PersonResponse;

import java.util.ArrayList;
import java.util.List;

public record OrganizationTreeResponse(
    Long companyId,
    String companyName,
    List<DepartmentNode> departments
) {

    public record DepartmentNode(
        Long id,
        String name,
        Integer depth,
        List<PersonResponse> persons,
        List<DepartmentNode> children
    ) {
        public DepartmentNode(Long id, String name, Integer depth) {
            this(id, name, depth, new ArrayList<>(), new ArrayList<>());
        }
    }
}
