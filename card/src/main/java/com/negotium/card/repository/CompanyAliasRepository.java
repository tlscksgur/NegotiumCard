package com.negotium.card.repository;

import com.negotium.card.entity.CompanyAlias;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyAliasRepository extends JpaRepository<CompanyAlias, Long> {

    Optional<CompanyAlias> findByNormalizedAlias(String normalizedAlias);
}
