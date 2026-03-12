package com.negotium.card.repository;

import com.negotium.card.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByNormalizedName(String normalizedName);

    @Query("""
        select distinct c
        from Company c
        join Person p on p.company = c
        join Card card on card.person = p
        where card.user.id = :userId
        order by c.name asc
        """)
    List<Company> findAllByUserId(Long userId);

    @Query("""
        select distinct c
        from Company c
        join Person p on p.company = c
        join Card card on card.person = p
        where c.id = :companyId
          and card.user.id = :userId
        """)
    Optional<Company> findAccessibleCompany(Long companyId, Long userId);

    @Query("""
        select distinct c
        from Company c
        join Person p on p.company = c
        join Card card on card.person = p
        where card.user.id = :userId
          and lower(c.name) like lower(concat('%', :keyword, '%'))
        order by c.name asc
        """)
    List<Company> searchByName(Long userId, String keyword);
}
