package com.negotium.card.department.controller;

import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.department.service.DepartmentService;
import com.negotium.card.org.dto.OrganizationTreeResponse;
import com.negotium.card.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentService departmentService;

    @GetMapping("/{id}")
    public DepartmentResponse getDepartment(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return departmentService.getDepartment(id, user.getId());
    }

    @GetMapping("/{id}/children")
    public List<DepartmentResponse> getChildren(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return departmentService.getChildren(id, user.getId());
    }

    @GetMapping("/{id}/tree")
    public OrganizationTreeResponse.DepartmentNode getTree(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return departmentService.getDepartmentTree(id, user.getId());
    }
}
