package com.negotium.card.person.controller;

import com.negotium.card.person.dto.PersonResponse;
import com.negotium.card.person.dto.PersonUpdateRequest;
import com.negotium.card.person.service.PersonService;
import com.negotium.card.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/persons")
@RequiredArgsConstructor
public class PersonController {

    private final PersonService personService;

    @GetMapping
    public List<PersonResponse> getPersons(@AuthenticationPrincipal SecurityUser user) {
        return personService.getPersons(user.getId());
    }

    @GetMapping("/{id}")
    public PersonResponse getPerson(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return personService.getPerson(id, user.getId());
    }

    @PatchMapping("/{id}")
    public PersonResponse updatePerson(
        @PathVariable Long id,
        @Valid @RequestBody PersonUpdateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return personService.updatePerson(id, user.getId(), request);
    }
}
