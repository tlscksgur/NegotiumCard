package com.negotium.card.repository;

import com.negotium.card.entity.Memo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MemoRepository extends JpaRepository<Memo, Long> {

    List<Memo> findByPersonId(Long personId);

    @Query("""
        select m
        from Memo m
        where m.person.id = :personId
          and m.user.id = :userId
        order by m.createdAt desc
        """)
    List<Memo> findByPersonIdAndUserId(Long personId, Long userId);
}
