package com.negotium.card.company.service;

import com.negotium.card.company.dto.CompanyResponse;
import com.negotium.card.entity.Company;
import com.negotium.card.entity.Department;
import com.negotium.card.entity.Person;
import com.negotium.card.org.dto.OrganizationTreeResponse;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.repository.CompanyRepository;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final DepartmentRepository departmentRepository;
    private final PersonRepository personRepository;

    @Transactional(readOnly = true)
    public List<CompanyResponse> getCompanies(Long userId) {
        return companyRepository.findAllByUserId(userId).stream()
            .map(CompanyResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public CompanyResponse getCompany(Long companyId, Long userId) {
        Company company = companyRepository.findAccessibleCompany(companyId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Company not found."));
        return CompanyResponse.from(company);
    }

    @Transactional(readOnly = true)
    public OrganizationTreeResponse getCompanyTree(Long companyId, Long userId) {
        Company company = companyRepository.findAccessibleCompany(companyId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Company not found."));

        List<Department> departments = departmentRepository.findAllByCompanyIdOrderByDepthAscNameAsc(companyId);
        List<Person> persons = personRepository.findAllByUserId(userId).stream()
            .filter(person -> person.getCompany() != null && companyId.equals(person.getCompany().getId()))
            .toList();

        return buildTree(company, departments, persons);
    }

    private OrganizationTreeResponse buildTree(Company company, List<Department> departments, List<Person> persons) {
        Map<Long, OrganizationTreeResponse.DepartmentNode> nodes = new LinkedHashMap<>();
        List<OrganizationTreeResponse.DepartmentNode> roots = new ArrayList<>();

        for (Department department : departments) {
            nodes.put(
                department.getId(),
                new OrganizationTreeResponse.DepartmentNode(department.getId(), department.getName(), department.getDepth())
            );
        }

        for (Department department : departments) {
            OrganizationTreeResponse.DepartmentNode current = nodes.get(department.getId());
            if (department.getParent() == null) {
                roots.add(current);
            } else {
                OrganizationTreeResponse.DepartmentNode parent = nodes.get(department.getParent().getId());
                if (parent != null) {
                    parent.children().add(current);
                }
            }
        }

        for (Person person : persons) {
            if (person.getDepartment() == null) {
                continue;
            }
            OrganizationTreeResponse.DepartmentNode node = nodes.get(person.getDepartment().getId());
            if (node != null) {
                node.persons().add(PersonResponse.from(person));
            }
        }

        return new OrganizationTreeResponse(company.getId(), company.getName(), roots);
    }
}
