package com.negotium.card.search.controller;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.search.service.SearchService;
import com.negotium.card.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping("/persons")
    public List<PersonResponse> searchPersons(
        @RequestParam(required = false) String name,
        @RequestParam(required = false) String company,
        @RequestParam(required = false) String department,
        @RequestParam(required = false) String position,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return searchService.searchPersons(user.getId(), name, company, department, position);
    }

    @GetMapping("/companies")
    public List<CompanyResponse> searchCompanies(
        @RequestParam String keyword,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return searchService.searchCompanies(user.getId(), keyword);
    }

    @GetMapping("/departments")
    public List<DepartmentResponse> searchDepartments(
        @RequestParam String keyword,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return searchService.searchDepartments(user.getId(), keyword);
    }
}
