package com.negotium.card.organization.service;

import com.negotium.card.card.dto.OcrResultUpdateRequest;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.Company;
import com.negotium.card.entity.CompanyAlias;
import com.negotium.card.entity.Department;
import com.negotium.card.entity.OcrResult;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.Position;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.CompanyAliasRepository;
import com.negotium.card.repository.CompanyRepository;
import com.negotium.card.repository.DepartmentRepository;
import com.negotium.card.repository.OcrResultRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class OrganizationSyncService {

    private static final Pattern DEPARTMENT_SEPARATOR = Pattern.compile("\\s*(?:>|/|\\\\|\\|)\\s*");

    private final CardRepository cardRepository;
    private final OcrResultRepository ocrResultRepository;
    private final CompanyRepository companyRepository;
    private final CompanyAliasRepository companyAliasRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final PersonRepository personRepository;

    @Transactional
    public Card syncFromOcr(Long cardId, Long userId) {
        Card card = loadAccessibleCard(cardId, userId);
        OcrResult ocrResult = card.getOcrResult();
        if (ocrResult == null) {
            return card;
        }

        sync(card, ocrResult);
        return cardRepository.save(card);
    }

    @Transactional
    public Card updateOcrAndSync(Long cardId, Long userId, OcrResultUpdateRequest request) {
        Card card = loadAccessibleCard(cardId, userId);
        OcrResult ocrResult = ocrResultRepository.findByCardId(cardId)
            .orElseGet(() -> OcrResult.builder().card(card).build());

        if (request.rawText() != null) {
            ocrResult.setRawText(normalizeText(request.rawText()));
        }
        if (request.name() != null) {
            ocrResult.setName(normalizeText(request.name()));
        }
        if (request.company() != null) {
            ocrResult.setCompany(normalizeText(request.company()));
        }
        if (request.department() != null) {
            ocrResult.setDepartment(normalizeText(request.department()));
        }
        if (request.position() != null) {
            ocrResult.setPosition(normalizeText(request.position()));
        }
        if (request.email() != null) {
            ocrResult.setEmail(normalizeText(request.email()));
        }
        if (request.phone() != null) {
            ocrResult.setPhone(normalizeText(request.phone()));
        }

        OcrResult savedOcrResult = ocrResultRepository.save(ocrResult);
        card.setOcrResult(savedOcrResult);
        sync(card, savedOcrResult);
        return cardRepository.save(card);
    }

    private void sync(Card card, OcrResult ocrResult) {
        Person previousPerson = card.getPerson();
        Company company = resolveCompany(
            ocrResult.getCompany(),
            previousPerson != null ? previousPerson.getCompany() : null
        );
        Department department = resolveDepartment(
            company,
            ocrResult.getDepartment(),
            previousPerson != null ? previousPerson.getDepartment() : null
        );
        Position position = resolvePosition(
            ocrResult.getPosition(),
            previousPerson != null ? previousPerson.getPosition() : null
        );
        Person person = resolvePerson(ocrResult, company, department, position, previousPerson);

        card.setPerson(person);
    }

    private Person resolvePerson(
        OcrResult ocrResult,
        Company company,
        Department department,
        Position position,
        Person previousPerson
    ) {
        Person person = previousPerson;

        if (person == null && company != null && StringUtils.hasText(ocrResult.getEmail())) {
            person = personRepository.findByCompanyIdAndEmail(company.getId(), ocrResult.getEmail().trim()).orElse(null);
        }

        if (person == null) {
            person = Person.builder().build();
        }

        String name = firstText(ocrResult.getName(), person.getName(), "Unknown");
        person.setName(name);
        person.setNormalizedName(normalizeKey(name));
        person.setEmail(firstText(ocrResult.getEmail(), person.getEmail(), null));
        person.setPhone(firstText(ocrResult.getPhone(), person.getPhone(), null));
        person.setCompany(company);
        person.setDepartment(department);
        person.setPosition(position);

        return personRepository.save(person);
    }

    private Company resolveCompany(String companyName, Company fallback) {
        String normalized = normalizeKey(companyName);
        if (!StringUtils.hasText(normalized)) {
            return fallback;
        }

        Optional<CompanyAlias> alias = companyAliasRepository.findByNormalizedAlias(normalized);
        if (alias.isPresent()) {
            return alias.get().getCompany();
        }

        Optional<Company> existing = companyRepository.findByNormalizedName(normalized);
        if (existing.isPresent()) {
            saveAliasIfMissing(existing.get(), companyName, normalized);
            return existing.get();
        }

        Company company = companyRepository.save(Company.builder()
            .name(normalizeText(companyName))
            .normalizedName(normalized)
            .build());
        saveAliasIfMissing(company, companyName, normalized);
        return company;
    }

    private void saveAliasIfMissing(Company company, String alias, String normalizedAlias) {
        if (!StringUtils.hasText(alias) || companyAliasRepository.findByNormalizedAlias(normalizedAlias).isPresent()) {
            return;
        }

        companyAliasRepository.save(CompanyAlias.builder()
            .company(company)
            .alias(normalizeText(alias))
            .normalizedAlias(normalizedAlias)
            .build());
    }

    private Department resolveDepartment(Company company, String departmentName, Department fallback) {
        if (company == null) {
            return fallback;
        }

        List<String> parts = splitDepartmentPath(departmentName);
        if (parts.isEmpty()) {
            return fallback;
        }

        Department parent = null;
        Department current = null;
        for (int index = 0; index < parts.size(); index++) {
            String part = parts.get(index);
            current = departmentRepository.findByCompanyAndParentAndName(company, parent, part).orElse(null);
            if (current == null) {
                current = departmentRepository.save(Department.builder()
                    .company(company)
                    .parent(parent)
                    .name(part)
                    .depth(index)
                    .build());
            }
            parent = current;
        }

        return current;
    }

    private Position resolvePosition(String positionName, Position fallback) {
        String normalized = normalizeText(positionName);
        if (!StringUtils.hasText(normalized)) {
            return fallback;
        }

        return positionRepository.findByNameIgnoreCase(normalized)
            .orElseGet(() -> positionRepository.save(Position.builder()
                .name(normalized)
                .level(guessPositionLevel(normalized))
                .build()));
    }

    private Integer guessPositionLevel(String positionName) {
        String lower = positionName.toLowerCase(Locale.ROOT);
        if (lower.contains("ceo") || lower.contains("cto") || lower.contains("cfo") || lower.contains("coo")) {
            return 5;
        }
        if (lower.contains("vp") || lower.contains("vice president")) {
            return 4;
        }
        if (lower.contains("director") || lower.contains("head")) {
            return 3;
        }
        if (lower.contains("manager") || lower.contains("lead")) {
            return 2;
        }
        return 1;
    }

    private List<String> splitDepartmentPath(String departmentName) {
        if (!StringUtils.hasText(departmentName)) {
            return List.of();
        }

        String normalized = normalizeText(departmentName);
        String[] tokens = DEPARTMENT_SEPARATOR.split(normalized);
        List<String> parts = new ArrayList<>();

        for (String token : tokens) {
            String part = normalizeText(token);
            if (StringUtils.hasText(part)) {
                parts.add(part);
            }
        }

        if (parts.isEmpty()) {
            parts.add(normalized);
        }
        return parts;
    }

    private Card loadAccessibleCard(Long cardId, Long userId) {
        return cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim().replaceAll("\\s+", " ");
    }

    private String normalizeKey(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim()
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", "");
    }

    private String firstText(String primary, String secondary, String defaultValue) {
        if (StringUtils.hasText(primary)) {
            return normalizeText(primary);
        }
        if (StringUtils.hasText(secondary)) {
            return normalizeText(secondary);
        }
        return defaultValue;
    }
}
