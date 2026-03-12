package com.negotium.card.tag.dto;

import com.negotium.card.entity.Tag;

public record TagResponse(
    Long id,
    String name
) {

    public static TagResponse from(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName());
    }
}
