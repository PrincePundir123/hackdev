# Saathi Care AI

An elder-care project proposal for Next Byte Hacks V5, developed from an analysis of the published Suraksha case study.

**Current status:** This repository contains the project blueprint and the script used to generate it. The proposed application has not been implemented or clinically validated.

## Project concept

Saathi Care AI is a proposed companion that helps older adults create reminders and request support while controlling what trusted contacts can see. Its care workflow tracks who accepts responsibility, handles unanswered requests, and records follow-up separately from acknowledgment.

The proposed prototype focuses on:

- Confirmed natural-language reminders and simple check-ins.
- Contact-specific sharing permissions and previews.
- Caregiver acceptance, decline, and backup handoffs.
- A persistent incident timeline and explicit outcomes.
- Clearly labelled drills using synthetic events.

## Read the blueprint

- [Download the detailed 24-page PDF](deliverables/Saathi_Care_AI_Hackathon_Project_Blueprint.pdf)
- [HTML version](deliverables/Saathi_Care_AI_Hackathon_Project_Blueprint.html) — download and open in a browser.
- [Report generation script](deliverables/build_report.py)

The report covers the problem statement, source analysis, proposed features, user journeys, architecture, permission model, testing, build schedule, and draft hackathon submission. Event details were checked on 18 October 2026 and should be rechecked before submission.

## Regenerate the report

The current generator is configured for Windows and uses Calibri fonts from `C:/Windows/Fonts`.

```powershell
python -m pip install -r requirements.txt
python deliverables/build_report.py
```

The script regenerates the PDF and HTML and creates local layout diagnostics and preview images. Those diagnostic files are excluded from version control. To run on another operating system, update the font archive path and font declarations in the script.

## Attribution

Inspired by the Suraksha elder-care case study by Team StarBugs. Saathi Care AI is a separate project proposal; this repository does not claim ownership of the original Suraksha application, code, or prizes.

- [Original developer article](https://builder.aws.com/content/3K6LxdJtlqL9aB4rmjHJB0aMses/the-first-commit-of-our-hackathon-game-or-wemakedevs-aws-winners-of-ship-it-track)
- [Official First Commit winners](https://www.wemakedevs.org/aws/first-commit/projects)
- [Next Byte Hacks V5](https://next-byte-hacks-v5.devpost.com/)

The report contains further sources and distinguishes proposed functionality from verified reference material. It does not establish medical effectiveness, validated fall detection, or guaranteed emergency response.
