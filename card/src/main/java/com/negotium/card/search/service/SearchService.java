package com.negotium.card.search.service;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.repository.CompanyRepository;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.search.dto.PagedResponse;
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
    public PagedResponse<PersonResponse> searchPersons(
        Long userId,
        String name,
        String company,
        String department,
        String position,
        int page,
        int size
    ) {
        return paginate(
            personRepository.search(userId, name, company, department, position).stream().map(PersonResponse::from).toList(),
            page,
            size
        );
    }

    @Transactional(readOnly = true)
    public PagedResponse<CompanyResponse> searchCompanies(Long userId, String keyword, int page, int size) {
        return paginate(companyRepository.searchByName(userId, keyword).stream().map(CompanyResponse::from).toList(), page, size);
    }

    @Transactional(readOnly = true)
    public PagedResponse<DepartmentResponse> searchDepartments(Long userId, String keyword, int page, int size) {
        return paginate(departmentRepository.searchByName(userId, keyword).stream().map(DepartmentResponse::from).toList(), page, size);
    }

    private <T> PagedResponse<T> paginate(List<T> items, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        int fromIndex = Math.min(safePage * safeSize, items.size());
        int toIndex = Math.min(fromIndex + safeSize, items.size());
        List<T> content = items.subList(fromIndex, toIndex);
        int totalPages = items.isEmpty() ? 0 : (int) Math.ceil((double) items.size() / safeSize);
        return new PagedResponse<>(content, safePage, safeSize, items.size(), totalPages);
    }
}
