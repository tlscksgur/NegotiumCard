package com.negotium.card.repository;

import com.negotium.card.entity.Person;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Long> {

    Optional<Person> findByCompanyIdAndEmail(Long companyId, String email);

    List<Person> findByCompanyId(Long companyId);

    @Query("""
        select distinct p
        from Person p
        join Card c on c.person = p
        left join fetch p.company
        left join fetch p.department
        left join fetch p.position
        where c.user.id = :userId
        order by p.createdAt desc
        """)
    List<Person> findAllByUserId(Long userId);

    @Query("""
        select distinct p
        from Person p
        join Card c on c.person = p
        left join fetch p.company
        left join fetch p.department
        left join fetch p.position
        where p.id = :personId
          and c.user.id = :userId
        """)
    Optional<Person> findAccessiblePerson(Long personId, Long userId);

    @Query("""
        select distinct p
        from Person p
        join Card c on c.person = p
        left join fetch p.company
        left join fetch p.department
        left join fetch p.position
        where c.user.id = :userId
          and (:name is null or lower(p.name) like lower(concat('%', :name, '%')))
          and (:company is null or lower(p.company.name) like lower(concat('%', :company, '%')))
          and (:department is null or lower(p.department.name) like lower(concat('%', :department, '%')))
          and (:position is null or lower(p.position.name) like lower(concat('%', :position, '%')))
        order by p.createdAt desc
        """)
    List<Person> search(Long userId, String name, String company, String department, String position);
}
