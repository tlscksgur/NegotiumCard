package com.negotium.card.repository;

import com.negotium.card.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CardRepository extends JpaRepository<Card, Long> {

    List<Card> findByUserId(Long userId);

    List<Card> findByPersonId(Long personId);

    Optional<Card> findByIdAndUserId(Long id, Long userId);

    boolean existsByPersonIdAndUserId(Long personId, Long userId);

    @Query("""
        select c
        from Card c
        left join fetch c.person p
        left join fetch p.company
        left join fetch p.department
        left join fetch p.position
        where c.user.id = :userId
        order by c.createdAt desc
        """)
    List<Card> findAllByUserIdWithPerson(Long userId);
}
