ALTER TABLE `opportunities` ADD `agency_type` text DEFAULT '기타 공공기관' NOT NULL;--> statement-breakpoint
CREATE INDEX `opportunities_agency_type_idx` ON `opportunities` (`agency_type`);--> statement-breakpoint
INSERT INTO `agencies`
  (`name`,`type`,`region_sido`,`homepage_url`,`source_type`,`source_config`,`is_active`)
SELECT
  '중소벤처기업부','기타 공공기관','전국',
  'https://mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310','scrape',
  '{"url":"https://mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310","rowSelector":".board_list tbody tr","titleSelector":"td.subject > a.pc-detail","publishedSelector":"td:nth-child(4)","deadlineSelector":"td.subject .tableInfoBox dl:nth-child(3) dd","idAttribute":"onclick","idPattern":"doBbsFView\\(''310'',''(\\d+)''","noticeType":"지원사업","maxItems":30}',
  1
WHERE NOT EXISTS (SELECT 1 FROM `agencies` WHERE `name`='중소벤처기업부' AND `source_type`='scrape');--> statement-breakpoint
PRAGMA optimize;
