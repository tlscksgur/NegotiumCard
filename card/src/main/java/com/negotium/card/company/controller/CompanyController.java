package com.negotium.card.company.controller;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.company.service.CompanyService;
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
@RequestMapping("/api/v1/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;

    @GetMapping
    public List<CompanyResponse> getCompanies(@AuthenticationPrincipal SecurityUser user) {
        return companyService.getCompanies(user.getId());
    }

    @GetMapping("/{id}")
    public CompanyResponse getCompany(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return companyService.getCompany(id, user.getId());
    }

    @GetMapping("/{id}/tree")
    public OrganizationTreeResponse getCompanyTree(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return companyService.getCompanyTree(id, user.getId());
    }
}
