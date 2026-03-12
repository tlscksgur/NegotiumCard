package com.negotium.card.tag.controller;

import com.negotium.card.security.SecurityUser;
import com.negotium.card.tag.dto.PersonTagCreateRequest;
import com.negotium.card.tag.dto.TagCreateRequest;
import com.negotium.card.tag.dto.TagResponse;
import com.negotium.card.tag.service.TagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @PostMapping("/api/v1/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public TagResponse createTag(@Valid @RequestBody TagCreateRequest request) {
        return tagService.createTag(request);
    }

    @PostMapping("/api/v1/persons/{id}/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public TagResponse attachTag(
        @PathVariable Long id,
        @Valid @RequestBody PersonTagCreateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return tagService.attachTag(id, user.getId(), request);
    }

    @GetMapping("/api/v1/persons/{id}/tags")
    public List<TagResponse> getPersonTags(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return tagService.getPersonTags(id, user.getId());
    }
}
