package com.negotium.card.repository;

import com.negotium.card.entity.Position;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {

    Optional<Position> findByName(String name);

    Optional<Position> findByNameIgnoreCase(String name);
}
