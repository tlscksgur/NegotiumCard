package com.negotium.card.search.service;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.repository.CompanyRepository;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final PersonRepository personRepository;
    private final CompanyRepository companyRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional(readOnly = true)
    public List<PersonResponse> searchPersons(Long userId, String name, String company, String department, String position) {
        return personRepository.search(userId, name, company, department, position).stream()
            .map(PersonResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<CompanyResponse> searchCompanies(Long userId, String keyword) {
        return companyRepository.searchByName(userId, keyword).stream()
            .map(CompanyResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> searchDepartments(Long userId, String keyword) {
        return departmentRepository.searchByName(userId, keyword).stream()
            .map(DepartmentResponse::from)
            .toList();
    }
}
