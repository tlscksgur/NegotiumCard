package com.negotium.card.repository;

import com.negotium.card.entity.Company;
import com.negotium.card.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    Optional<Department> findByCompanyAndParentAndName(Company company, Department parent, String name);

    List<Department> findByCompanyId(Long companyId);

    List<Department> findByParentId(Long parentId);

    @Query("""
        select distinct d
        from Department d
        join Person p on p.department = d
        join Card card on card.person = p
        where card.user.id = :userId
        order by d.depth asc, d.name asc
        """)
    List<Department> findAllByUserId(Long userId);

    @Query("""
        select distinct d
        from Department d
        join Person p on p.department = d
        join Card card on card.person = p
        where d.id = :departmentId
          and card.user.id = :userId
        """)
    Optional<Department> findAccessibleDepartment(Long departmentId, Long userId);

    @Query("""
        select d
        from Department d
        where d.company.id = :companyId
        order by d.depth asc, d.name asc
        """)
    List<Department> findAllByCompanyIdOrderByDepthAscNameAsc(Long companyId);

    @Query("""
        select distinct d
        from Department d
        join Person p on p.department = d
        join Card card on card.person = p
        where card.user.id = :userId
          and lower(d.name) like lower(concat('%', :keyword, '%'))
        order by d.depth asc, d.name asc
        """)
    List<Department> searchByName(Long userId, String keyword);
}
