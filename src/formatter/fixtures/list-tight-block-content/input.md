Checklist:

- Check that CI is happy.
- Run these commands and commit:
	```bash
	python scripts/make.py build_usage
	```
- Tag the release:
	```bash
	git tag -s X.Y.Z
	```
	This makes sure nothing uncommitted gets in.
- Announce on:
	- Mailing list.
	- IRC channel.

Loose lists still get spaced consistently:

- First item

- Second item:
	```bash
	echo hi
	```
- Third item
