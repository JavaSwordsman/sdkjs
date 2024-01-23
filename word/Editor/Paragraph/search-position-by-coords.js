/*
 * (c) Copyright Ascensio System SIA 2010-2023
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-6 Ernesta Birznieka-Upish
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

"use strict";

(function(window)
{
	const EPSILON  = 0.001;
	const MAX_DIFF = 1000000;
	
	/**
	 * Class for searching position in the paragraph
	 * @constructor
	 */
	function ParagraphSearchPositionXY()
	{
		this.line  = 0;
		this.range = 0;
		this.page  = 0;
		
		this.centerMode = true;  // Search the closest position (relative to the middle of the element), or we search a position beyond the specified x-coordinate
		this.stepEnd    = false; // Search for position beyond the mark of paragraph
		
		this.curX    = 0;
		this.x       = 0;
		this.diffX   = MAX_DIFF;
		this.diffAbs = MAX_DIFF;
		
		this.numbering = false;
		this.inText    = false;
		this.inTextX   = false;
		this.paraEnd   = false;
		
		this.bidiFlow = new AscWord.BidiFlow(this);
		this.rtl      = false;
		
		// TODO: Unite with CRunWithPosition class
		this.pos     = null;
		this.posInfo = {
			run : null,
			pos : 0
		};
		
		this.inTextPos     = null;
		this.inTextPosInfo = {
			run : null,
			pos : 0
		};
	}
	ParagraphSearchPositionXY.prototype.init = function(paragraph, stepEnd, centerMode)
	{
		this.paragraph  = paragraph;
		this.stepEnd    = undefined !== stepEnd ? stepEnd : false;
		this.centerMode = undefined !== centerMode ? centerMode : true;
	};
	ParagraphSearchPositionXY.prototype.setDiff = function(diff)
	{
		this.diffX   = Math.abs(diff);
		this.diffAbs = diff;
	};
	ParagraphSearchPositionXY.prototype.searchByXY = function(x, y, page)
	{
		if (this.correctPageAndLineNumber(page))
			this.line = this.calculateLineNumber(y, this.page);
		else
			y = undefined;
		
		this.searchByLine(x, this.line, page, y);
	};
	ParagraphSearchPositionXY.prototype.searchByLine = function(x, line, page, y)
	{
		this.pos       = null;
		this.inTextPos = null;
		
		this.line = line;
		this.correctPageAndLineNumber(page);
		
		this.range = this.calculateRangeNumber(x);
		if (-1 === this.range)
			return;
		
		let para = this.paragraph;
		let paraRange = para.Lines[this.line].Ranges[this.range];
		
		this.x    = x;
		this.curX = paraRange.XVisible;
		
		this.checkNumbering();
		
		let startPos = paraRange.StartPos;
		let endPos   = paraRange.EndPos;
		
		// Do not enter to the run containing paragraphMark if we don't want to
		if (true !== this.stepEnd && endPos === para.Content.length - 1 && endPos > startPos)
			--endPos;
		
		for (let pos = startPos; pos <= endPos; ++pos)
		{
			para.Content[pos].getParagraphContentPosByXY(this);
		}
		
		this.checkInText()
		
		if (this.diffX > MAX_DIFF - 1)
		{
			this.line  = -1;
			this.range = -1;
			
			this.pos       = para.GetStartPos();
			this.inTextPos = this.pos.Copy();
		}
	};
	ParagraphSearchPositionXY.prototype.handleRun = function(run)
	{
		// TODO: Тут сохраняем ран на случай, если мы не найдем ни одного элемента
		//       и нам нужно будет хоть к чему-то привязаться
		
		// if (CurPos >= EndPos)
		// {
		// 	// Заглушка, чтобы мы тыкая вправо попадали в самый правый пустой ран
		//
		// 	// Проверяем, попали ли мы в данный элемент
		// 	var Diff = SearchPos.X - SearchPos.CurX;
		//
		// 	if (((Diff <= 0 && Math.abs(Diff) < SearchPos.DiffX - 0.001) || (Diff > 0 && Diff < SearchPos.DiffX + 0.001)) && (SearchPos.CenterMode || SearchPos.X > SearchPos.CurX) && InMathText == false)
		// 	{
		// 		SearchPos.SetDiffX(Diff);
		// 		SearchPos.Pos.Update(CurPos, Depth);
		// 		Result = true;
		// 	}
		// }
		
		
		// // Такое возможно, если все раны до этого (в том числе и этот) были пустыми, тогда, чтобы не возвращать
		// // неправильную позицию вернем позицию начала данного путого рана.
		// if ( SearchPos.DiffX > 1000000 - 1 )
		// {
		// 	SearchPos.SetDiffX(SearchPos.X - SearchPos.CurX);
		// 	SearchPos.Pos.Update( StartPos, Depth );
		// 	Result = true;
		// }
		//
		// if (this.Type == para_Math_Run) // не только для пустых Run, но и для проверки на конец Run (т.к. Diff не обновляется)
		// {
		// 	//для пустых Run искомая позиция - позиция самого Run
		// 	var bEmpty = this.Is_Empty();
		//
		// 	var PosLine = this.ParaMath.GetLinePosition(_CurLine, _CurRange);
		//
		// 	if (bEmpty)
		// 		SearchPos.CurX = PosLine.x + this.pos.x;
		//
		// 	Diff = SearchPos.X - SearchPos.CurX;
		// 	if (SearchPos.InText == false && (bEmpty || StartPos !== EndPos) && (Math.abs(Diff) < SearchPos.DiffX + 0.001 && (SearchPos.CenterMode || SearchPos.X > SearchPos.CurX)))
		// 	{
		// 		SearchPos.SetDiffX(Diff);
		// 		SearchPos.Pos.Update(CurPos, Depth);
		// 		Result = true;
		// 	}
		// }
		
	};
	ParagraphSearchPositionXY.prototype.handleRunElement = function(element, run, inRunPos)
	{
		this.bidiFlow.add([element, run, inRunPos], element.getBidiType());
	};
	ParagraphSearchPositionXY.prototype.handleBidiFlow = function(data)
	{
		let item     = data[0];
		let run      = data[1];
		let inRunPos = data[2];
		
		let w = 0;
		if (!item.IsDrawing() || item.IsInline())
			w = item.GetWidthVisible();
		
		// TODO: Math
		// if (this.Type == para_Math_Run)
		// {
		// 	var PosLine    = this.ParaMath.GetLinePosition(_CurLine, _CurRange);
		// 	var loc        = this.Content[CurPos].GetLocationOfLetter();
		// 	SearchPos.CurX = PosLine.x + loc.x; // позиция формулы в строке + смещение буквы в контенте
		// }
		
		let diff = this.x - this.curX;
		if (-EPSILON <= diff && diff <= w + EPSILON)
		{
			this.inTextX = true;
			this.inTextPosInfo.run = run;
			this.inTextPosInfo.pos = inRunPos;
		}
		
		if (this.checkPosition(diff))
		{
			this.setDiff(diff);
			this.posInfo.run = run;
			this.posInfo.pos = inRunPos;
		}
		
		if (item.RGap)
			w -= item.RGap;
		
		this.curX += w;
		
		diff = this.x - this.curX;
		
		// TODO: Check comb forms
		if (!item.IsBreak() && this.checkPosition(diff))
		{
			if (item.IsParaEnd())
				this.paraEnd = true;
			
			if (!item.IsParaEnd() || this.stepEnd)
			{
				if (item.RGap)
					diff = Math.min(diff, diff - item.RGap);
				
				this.setDiff(diff);
				this.posInfo.run = run;
				this.posInfo.pos = inRunPos + 1;
			}
		}
		
		if (item.RGap)
			this.curX += item.RGap;
	};
	ParagraphSearchPositionXY.prototype.getPos = function()
	{
		if (this.pos)
			return this.pos;
		
		this.pos = this.getPosByPosInfo(this.posInfo)
		return this.pos;
	};
	ParagraphSearchPositionXY.prototype.getInTextPos = function()
	{
		if (this.inTextPos)
			return this.inTextPos;
		
		this.inTextPos = this.getPosByPosInfo(this.inTextPosInfo);
		return this.inTextPos;
	};
	ParagraphSearchPositionXY.prototype.getLine = function()
	{
		return this.line;
	};
	ParagraphSearchPositionXY.prototype.getRange = function()
	{
		return this.range;
	};
	ParagraphSearchPositionXY.prototype.isNumbering = function()
	{
		return this.numbering;
	};
	ParagraphSearchPositionXY.prototype.isBeyondEnd = function()
	{
		return this.paraEnd;
	};
	ParagraphSearchPositionXY.prototype.isInText = function()
	{
		return this.inText;
	};
	ParagraphSearchPositionXY.prototype.isInTextByX = function()
	{
		return this.inTextX;
	};
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private area
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	ParagraphSearchPositionXY.prototype.correctPageAndLineNumber = function(page)
	{
		this.page = (-1 === page || undefined === page || null === page ? 0 : page);
		
		let pageCount = this.paragraph.getPageCount();
		if (this.page >= pageCount)
		{
			this.page = pageCount - 1;
			this.line = this.paragraph.getLineCount() - 1;
			return false;
		}
		else if (this.page < 0)
		{
			this.page = 0;
			this.line = 0;
			return false;
		}
		
		return true;
	};
	ParagraphSearchPositionXY.prototype.calculateLineNumber = function(y, page)
	{
		let p = this.paragraph;
		
		let line     = p.Pages[page].FirstLine;
		let lastLine = page >= p.getPageCount() - 1 ? p.getLineCount() - 1 : p.Pages[page + 1].FirstLine - 1;
		
		for (; line < lastLine; ++line)
		{
			let lineY = p.Pages[page].Y + p.Lines[line].Y + p.Lines[line].Metrics.Descent + p.Lines[line].Metrics.LineGap;
			if (y < lineY)
				break;
		}
		
		return line;
	};
	ParagraphSearchPositionXY.prototype.calculateRangeNumber = function(x)
	{
		let p = this.paragraph;
		
		let rangeCount = p.Lines[this.line].Ranges.length;
		if (rangeCount <= 0)
			return -1;
		else if (1 === rangeCount)
			return 0;
		
		let range = 0;
		for (; range < rangeCount - 1; ++range)
		{
			let currRange = p.Lines[this.line].Ranges[range];
			let nextRange = p.Lines[this.line].Ranges[range + 1];
			if (x < (currRange.XEnd + nextRange.X) / 2 || currRange.WEnd > 0.001)
				break;
		}
		
		return Math.max(0, Math.min(range, rangeCount - 1));
	};
	ParagraphSearchPositionXY.prototype.checkNumbering = function()
	{
		let p = this.paragraph;
		if (!p.Numbering.checkRange(this.range, this.line))
			return;
		
		let numPr = p.GetNumPr();
		if (para_Numbering === p.Numbering.Type && numPr && numPr.IsValid())
		{
			let numJc = p.Parent.GetNumbering().GetNum(numPr.NumId).GetLvl(numPr.Lvl).GetJc();
			
			let numX0 = this.curX;
			let numX1 = this.curX;
			
			switch (numJc)
			{
				case align_Right:
				{
					numX0 -= p.Numbering.WidthNum;
					break;
				}
				case align_Center:
				{
					numX0 -= p.Numbering.WidthNum / 2;
					numX1 += p.Numbering.WidthNum / 2;
					break;
				}
				case align_Left:
				default:
				{
					numX1 += p.Numbering.WidthNum;
					break;
				}
			}
			
			if (numX0 <= this.x && this.x <= numX1)
				this.numbering = true;
		}
		
		this.curX += p.Numbering.WidthVisible;
	};
	ParagraphSearchPositionXY.prototype.checkPosition = function(diff)
	{
		return (((diff <= 0 && Math.abs(diff) < this.diffX - EPSILON) || (diff > 0 && diff < this.diffX + EPSILON))
			&& (this.centerMode || this.x > this.curX));
	}
	ParagraphSearchPositionXY.prototype.checkInText = function(y)
	{
		this.inText = false;
		if (!this.inTextX || undefined === y)
			return;
		
		let p = this.paragraph;
		
		let lineTop    = p.Pages[this.page].Y + p.Lines[this.line].Y - p.Lines[this.line].Metrics.Ascent - EPSILON;
		let lineBottom = p.Pages[this.page].Y + p.Lines[this.line].Y + p.Lines[this.line].Metrics.Descent + p.Lines[this.line].Metrics.LineGap + EPSILON;
		
		return (lineTop <= y && y <= lineBottom);
	};
	ParagraphSearchPositionXY.prototype.getPosByPosInfo = function(posInfo)
	{
		let paraPos = this.paragraph.GetPosByElement(posInfo.run);
		paraPos.Update(posInfo.pos, paraPos.GetDepth() + 1);
		return this.paragraph.private_GetClosestPosInCombiningMark(paraPos, this.diffAbs);
	};
	//--------------------------------------------------------export----------------------------------------------------
	AscWord.ParagraphSearchPositionXY = ParagraphSearchPositionXY;
	
})(window);


