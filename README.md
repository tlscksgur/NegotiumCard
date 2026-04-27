# 📇 Negotium Card

## AI 기반 스마트 명함 관리 서비스

---

## 🚀 프로젝트 개요

Negotium Card는 오프라인 명함 정보를 디지털로 관리하고,  
명함에 포함된 **회사 / 부서 / 직책 정보를 기반으로 조직도를 자동 생성**하는 서비스입니다.

명함 이미지를 업로드하면 YOLO 기반 영역 탐지와 OCR을 통해 텍스트를 추출하고,  
이를 구조화된 데이터로 변환하여 인물 검색 및 조직도 탐색 기능을 제공합니다.

---

## ❗ 문제 정의

- 명함을 개인적으로 보관하여 체계적인 관리가 어려움  
- 조직 구조 및 인물 관계를 파악하기 어려움  

---

## 🎯 해결 목표

- 명함 데이터를 기반으로 조직도 자동 생성  
- 인물 및 조직 구조 탐색 기능 제공  
- 빠른 검색 및 관리 기능 제공  

---

## ✨ 주요 기능

### 🔐 인증
- Spring Security + JWT 기반 인증
- 사용자별 명함 데이터 분리 관리

### 📷 명함 업로드
- 웹 및 모바일 환경에서 이미지 업로드
- AWS S3를 통한 이미지 저장

### 🤖 AI 기반 명함 분석
- YOLOv8: 명함 내 텍스트 영역 탐지
- OCR (Google Vision API): 텍스트 추출
- 영역 단위 OCR 처리로 정확도 향상

### 🧠 데이터 구조화
- 정규식 및 키워드 기반 파싱
- 이름 / 회사 / 부서 / 직책 / 이메일 / 전화번호 추출

### 💾 데이터 저장
- Card, Person, Company, Department, Position 구조로 저장
- unique index 및 트랜잭션 기반 중복 방지

### 🏢 조직도 자동 생성
- parent_id 기반 트리 구조 구성
- 회사 / 부서 / 직책 자동 생성

### 🔍 검색 기능
- QueryDSL 기반 동적 검색
- 이름 / 회사 / 부서 / 직책 기준 검색
- 페이징 지원

### 📝 데이터 수정 및 재처리
- OCR 결과 수정 기능 제공
- 수정 데이터 조직 구조에 반영
- 분석 결과 저장 및 재분석 가능

---

## 🛠 기술 스택

### Frontend
- React
- TypeScript
- Axios

### Backend
- Spring Boot
- JPA
- QueryDSL
- Spring Security

### AI Server
- FastAPI
- YOLOv8
- OCR (Google Vision API)

### Infra / DB
- MySQL
- Redis
- AWS S3
- EC2
- Docker
- Nginx
