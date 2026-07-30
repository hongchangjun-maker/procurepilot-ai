-- 선택적 데모 시드입니다. 운영 DB에는 자동 적용되지 않습니다.
-- 아래 데이터는 실제 공고가 아니라 UI/교육용 샘플임을 source_name에 명시합니다.
INSERT OR IGNORE INTO agencies
  (name,type,region_sido,homepage_url,source_type,source_config,is_active)
VALUES
  ('조달청 나라장터','기타 공공기관','전국','https://www.g2b.go.kr/','api','{"connector":"g2b"}',1),
  ('기업마당','기타 공공기관','전국','https://www.bizinfo.go.kr/','api','{"connector":"bizinfo"}',1);

INSERT OR IGNORE INTO opportunities
  (source_name,source_notice_id,title,agency_name,region_sido,category,notice_type,published_at,deadline_at,budget,summary_raw,detail_text,original_url,status,duplicate_key)
VALUES
  ('샘플 데이터','DEMO-001','[샘플] 공공 AI 교육 플랫폼 구축 용역','샘플 기관','서울','AI','입찰공고','2026-07-30','2026-08-20',180000000,'UI 검증을 위한 명시적 샘플입니다.','운영 수집 결과가 아니며 언제든 삭제할 수 있습니다.','https://www.g2b.go.kr/','진행중','sample-demo-001');
