package com.negotium.card.person.service;

import com.negotium.card.entity.Company;
import com.negotium.card.entity.Department;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.Position;
import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.person.dto.PersonUpdateRequest;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.CompanyRepository;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonService {

    private final PersonRepository personRepository;
    private final CardRepository cardRepository;
    private final CompanyRepository companyRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;

    @Transactional(readOnly = true)
    public List<PersonResponse> getPersons(Long userId) {
        return personRepository.findAllByUserId(userId).stream()
            .map(PersonResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public PersonResponse getPerson(Long personId, Long userId) {
        return PersonResponse.from(getAccessiblePerson(personId, userId));
    }

    @Transactional
    public PersonResponse updatePerson(Long personId, Long userId, PersonUpdateRequest request) {
        Person person = getAccessiblePerson(personId, userId);

        if (request.name() != null) {
            person.setName(request.name());
        }
        if (request.normalizedName() != null) {
            person.setNormalizedName(request.normalizedName());
        }
        if (request.email() != null) {
            person.setEmail(request.email());
        }
        if (request.phone() != null) {
            person.setPhone(request.phone());
        }
        if (request.companyId() != null) {
            Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new IllegalArgumentException("Company not found."));
            person.setCompany(company);
        }
        if (request.departmentId() != null) {
            Department department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> new IllegalArgumentException("Department not found."));
            person.setDepartment(department);
        }
        if (request.positionId() != null) {
            Position position = positionRepository.findById(request.positionId())
                .orElseThrow(() -> new IllegalArgumentException("Position not found."));
            person.setPosition(position);
        }

        return PersonResponse.from(personRepository.save(person));
    }

    private Person getAccessiblePerson(Long personId, Long userId) {
        if (!cardRepository.existsByPersonIdAndUserId(personId, userId)) {
            throw new IllegalArgumentException("Person is not accessible.");
        }

        return personRepository.findAccessiblePerson(personId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Person not found."));
    }
}
