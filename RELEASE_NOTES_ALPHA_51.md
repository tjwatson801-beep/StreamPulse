# StreamPulse alpha.51 — cue search and montage

Golden Moments can search a recording with multiple methods:

- General audio peaks using the section-based detector.
- Editable spoken phrases, initially Got one, Team wipe, Victory, and Clip that. Spoken search uses the local caption runtime, scans overlapping five-minute sections, and retains source timestamps.
- Experimental Windows OCR for Eliminated and Victory Royale screen text. The scan region can be adjusted to exclude chat/overlays. It samples every two seconds, so brief or unreadable messages may be missed. Text does not establish whose kill or win occurred.

Results combine nearby matches while retaining method/category labels. Filters let you review kills, multi-kills, wins, general highlights, or a particular search method. Failed optional methods are reported in the results message while successful methods retain their candidates.

Review and trim a candidate, assign a category, and add the cut to Montage. Export mixed, kills-only, wins-only or general selections, with a maximum duration of 15, 30 or 60 seconds. Up to three distinct versions use recording order, reverse order and alternating cuts. Camera focus, font, gold word highlights, optional regenerated captions and audio polish are supported. Short source selections produce shorter exports. Montage currently combines cuts from the imported recording; music and automatic identification of kill counters are not included.

Local caption dependencies and installed fonts remain required. Windows visual search requires an available OCR language. Exported versions use unique names and leave the original recording untouched.
