package com.negotium.card.tag.service;

import com.negotium.card.common.AccessGuard;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.PersonTag;
import com.negotium.card.entity.Tag;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.PersonTagRepository;
import com.negotium.card.repository.TagRepository;
import com.negotium.card.tag.dto.PersonTagCreateRequest;
import com.negotium.card.tag.dto.TagCreateRequest;
import com.negotium.card.tag.dto.TagResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;
    private final PersonTagRepository personTagRepository;
    private final PersonRepository personRepository;
    private final AccessGuard accessGuard;

    @Transactional
    public TagResponse createTag(TagCreateRequest request) {
        Tag tag = tagRepository.findByName(request.name())
            .orElseGet(() -> tagRepository.save(Tag.builder().name(request.name()).build()));
        return TagResponse.from(tag);
    }

    @Transactional
    public TagResponse attachTag(Long personId, Long userId, PersonTagCreateRequest request) {
        accessGuard.checkPersonAccess(personId, userId);

        Person person = personRepository.findById(personId)
            .orElseThrow(() -> new IllegalArgumentException("Person not found."));
        Tag tag = tagRepository.findById(request.tagId())
            .orElseThrow(() -> new IllegalArgumentException("Tag not found."));

        if (!personTagRepository.existsByPersonIdAndTagId(personId, tag.getId())) {
            personTagRepository.save(PersonTag.builder()
                .person(person)
                .tag(tag)
                .build());
        }

        return TagResponse.from(tag);
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getPersonTags(Long personId, Long userId) {
        accessGuard.checkPersonAccess(personId, userId);
        return personTagRepository.findAllWithTagByPersonId(personId).stream()
            .map(personTag -> TagResponse.from(personTag.getTag()))
            .toList();
    }
}
