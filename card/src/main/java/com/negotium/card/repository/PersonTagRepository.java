package com.negotium.card.repository;

import com.negotium.card.entity.PersonTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PersonTagRepository extends JpaRepository<PersonTag, Long> {

    List<PersonTag> findByPersonId(Long personId);

    boolean existsByPersonIdAndTagId(Long personId, Long tagId);

    @Query("""
        select pt
        from PersonTag pt
        join fetch pt.tag
        where pt.person.id = :personId
        order by pt.tag.name asc
        """)
    List<PersonTag> findAllWithTagByPersonId(Long personId);
}
