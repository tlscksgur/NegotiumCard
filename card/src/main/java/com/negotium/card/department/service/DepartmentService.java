package com.negotium.card.department.service;

import com.negotium.card.department.dto.DepartmentResponse;
import com.negotium.card.entity.Department;
import com.negotium.card.entity.Person;
import com.negotium.card.org.dto.OrganizationTreeResponse;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final PersonRepository personRepository;

    @Transactional(readOnly = true)
    public DepartmentResponse getDepartment(Long departmentId, Long userId) {
        Department department = getAccessibleDepartment(departmentId, userId);
        return DepartmentResponse.from(department);
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getChildren(Long departmentId, Long userId) {
        getAccessibleDepartment(departmentId, userId);
        return departmentRepository.findByParentId(departmentId).stream()
            .map(DepartmentResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public OrganizationTreeResponse.DepartmentNode getDepartmentTree(Long departmentId, Long userId) {
        Department root = getAccessibleDepartment(departmentId, userId);
        List<Department> all = departmentRepository.findAllByCompanyIdOrderByDepthAscNameAsc(root.getCompany().getId());
        List<Person> persons = personRepository.findAllByUserId(userId);
        return buildNode(root, all, persons);
    }

    private OrganizationTreeResponse.DepartmentNode buildNode(
        Department current,
        List<Department> all,
        List<Person> persons
    ) {
        OrganizationTreeResponse.DepartmentNode node =
            new OrganizationTreeResponse.DepartmentNode(current.getId(), current.getName(), current.getDepth());

        persons.stream()
            .filter(person -> person.getDepartment() != null && current.getId().equals(person.getDepartment().getId()))
            .map(PersonResponse::from)
            .forEach(node.persons()::add);

        all.stream()
            .filter(department -> department.getParent() != null && current.getId().equals(department.getParent().getId()))
            .map(child -> buildNode(child, all, persons))
            .forEach(node.children()::add);

        return node;
    }

    private Department getAccessibleDepartment(Long departmentId, Long userId) {
        return departmentRepository.findAccessibleDepartment(departmentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Department not found."));
    }
}
