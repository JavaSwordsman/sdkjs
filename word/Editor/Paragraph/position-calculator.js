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
	const BLACK_COLOR = new AscWord.CDocumentColor(0, 0, 0);
	
	/**
	 * Class for calculating the current position of the cursor
	 * @param {AscWord.Paragraph} paragraph
	 * @constructor
	 */
	function ParagraphPositionCalculator(paragraph)
	{
		this.paragraph = paragraph
		
		this.page = 0;
		this.line = 0;
		this.range = 0;
		
		this.x = 0;
		this.y = 0;
		
		this.bidi = new AscWord.BidiFlow(this);
		this.rtl  = false;
		
		this.isNextCurrent = false;
		this.nextRun       = null;
		
		this.posInfo = {
			x     : 0,
			y     : 0,
			run   : null,
			mathY : -1
		};
	}
	ParagraphPositionCalculator.prototype.reset = function(page, line, range)
	{
		this.isNextCurrent = false;
		this.nextRun       = null;
		
		this.page  = page;
		this.line  = line;
		this.range = range;
		
		let p = this.paragraph;
		
		this.x = p.Lines[line].Ranges[range].XVisible;
		this.y = p.Pages[page].Y + p.Lines[line].Y;
		
		if (p.Numbering.checkRange(range, line))
			this.x += p.Numbering.WidthVisible;
		
		this.bidi.begin();
	};
	ParagraphPositionCalculator.prototype.setNextCurrent = function(run)
	{
		this.isNextCurrent = true;
		this.nextRun       = run;
	};
	ParagraphPositionCalculator.prototype.handleRunElement = function(element, run, isCurrent, isNearFootnoteRef)
	{
		if (para_Drawing === element.Type && !element.IsInline())
		{
			if (isCurrent)
				this.setNextCurrent(run);
			return;
		}
		
		if (this.isNextCurrent)
		{
			isCurrent = true;
			this.isNextCurrent = false;
			run = this.nextRun;
			this.nextRun = null;
		}
		
		this.bidi.add([element, run, isCurrent, isNearFootnoteRef], element.getBidiType());
	};
	ParagraphPositionCalculator.prototype.handleBidiFlow = function(data)
	{
		let element   = data[0];
		let run       = data[1];
		let isCurrent = data[2];
		
		let w = element.GetWidthVisible();
		if (isCurrent)
		{
			this.posInfo.x = this.x;
			this.posInfo.y = this.y;
			
			if (element.getBidiType() === AscWord.BidiType.rtl)
				this.posInfo.x += w;
			
			this.posInfo.run = run;
		}
		
		this.x += w;

		// TODO: Position in form
		// if (Pos === this.Content.length)
		// {
		// 	var Item = this.Content[Pos - 1];
		// 	if (Item.RGap)
		// 	{
		// 		if (Item.RGapCount)
		// 		{
		// 			X -= Item.RGapCount * Item.RGapShift - (Item.RGapShift - Item.RGapCharWidth) / 2;
		// 		}
		// 		else
		// 		{
		// 			X -= Item.RGap;
		// 		}
		// 	}
		// }
		// else if (this.Content[Pos].LGap)
		// {
		// 	X += this.Content[Pos].LGap;
		// }
	};
	ParagraphPositionCalculator.prototype.handleMathRun = function(run, isCurrentRun, currentPos)
	{
		this.bidi.end();
		this.bidi.begin(this.rtl);
		
		if (!isCurrentRun)
			return;
		
		let paraMathLocation = run.ParaMath.GetLinePosition(this.line, this.range);
		
		this.x = paraMathLocation.x;
		this.y = paraMathLocation.y;
		
		let mathY = this.y;
		
		if (run.IsEmpty())
		{
			this.x += run.pos.x;
			this.y += run.pos.y;
		}
		else
		{
			let w = 0;
			if (!run.Content[currentPos])
			{
				currentPos = run.Content.length - 1;
				w          = run.Content[currentPos].GetWidthVisible();
			}
			
			let elementLocation = run.Content[currentPos].GetLocationOfLetter();
			this.x += elementLocation.x + w;
			this.y += elementLocation.y;
		}
		
		// TODO: Пометить данное место, как текущее
		this.posInfo.x     = this.x;
		this.posInfo.y     = this.y;
		this.posInfo.mathY = mathY;
		this.posInfo.run   = run;
	};
	ParagraphPositionCalculator.prototype.getXY = function()
	{
		this.bidi.end();
		return {x : this.posInfo.x, y : this.posInfo.y};
	};
	ParagraphPositionCalculator.prototype.getTargetXY = function()
	{
		this.bidi.end();
		let run = this.posInfo.run;
		if (!run)
			return {x : this.posInfo.x, y : this.posInfo.y, h : 0, ascent : 0};
		
		let textPr = run.getCompiledPr();
		let isNearFootnoteRef = run.IsCurPosNearFootEndnoteReference();
		
		let fontCoef = isNearFootnoteRef ? 1 : textPr.getFontCoef();
		AscCommon.g_oTextMeasurer.SetTextPr(textPr, this.paragraph.getTheme());
		AscCommon.g_oTextMeasurer.SetFontSlot(AscWord.fontslot_ASCII, fontCoef);
		
		let textHeight = AscCommon.g_oTextMeasurer.GetHeight();
		let descent    = Math.abs(AscCommon.g_oTextMeasurer.GetDescender());
		let ascent     = textHeight - descent;
		
		let y = this.posInfo.y - ascent - run.getYOffset();
		if (!isNearFootnoteRef)
		{
			if (AscCommon.vertalign_SubScript === textPr.VertAlign)
				y -= textPr.FontSize * g_dKoef_pt_to_mm * AscCommon.vaKSub;
			else if (AscCommon.vertalign_SuperScript === textPr.VertAlign)
				y -= textPr.FontSize * g_dKoef_pt_to_mm * AscCommon.vaKSuper;
		}
		
		let runParent = run.Parent;
		if (run.IsMathRun() && runParent && runParent.bRoot && runParent.bMath_OneLine)
		{
			let mathBounds = runParent.Get_Bounds();
			
			let y0 = y;
			let y1 = y + textHeight;
			
			let _y = runParent.pos.y - runParent.size.ascent;
			
			let _y0 = this.posInfo.mathY + _y - 0.2 * mathBounds.H;
			let _y1 = this.posInfo.mathY + _y + 1.4 * mathBounds.H;
			
			y0 = Math.max(y0, _y0);
			y1 = Math.min(y1, _y1);
			
			y = y0;
			textHeight = y1 - y0;
		}
		
		return {x : this.posInfo.x, y : y, h : textHeight, ascent : ascent};
	};
	/**
	 * @returns {AscWord.CDocumentColor}
	 */
	ParagraphPositionCalculator.prototype.getTargetColor = function()
	{
		if (!this.finalize())
			return BLACK_COLOR;
		
		let p      = this.paragraph;
		let textPr = this.posInfo.run.getCompiledPr();
		let color  = textPr.Color;
		
		if (textPr.TextFill)
		{
			textPr.TextFill.check(p.getTheme(), p.getColorMap());
			let RGBA = textPr.TextFill.getRGBAColor();
			return new AscWord.CDocumentColor(RGBA.R, RGBA.G, RGBA.B);
		}
		else if (textPr.Unifill)
		{
			textPr.Unifill.check(p.getTheme(), p.getColorMap());
			let RGBA = textPr.Unifill.getRGBAColor();
			return new AscWord.CDocumentColor(RGBA.R, RGBA.G, RGBA.B);
		}
		else if (color.IsAuto())
		{
			return this.posInfo.run.getAutoColor();
		}
		
		return color;
	};
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private area
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/**
	 * @returns {boolean}
	 */
	ParagraphPositionCalculator.prototype.finalize = function()
	{
		this.bidi.end();
		return !!this.posInfo.run;
	};
	//--------------------------------------------------------export----------------------------------------------------
	AscWord.ParagraphPositionCalculator = ParagraphPositionCalculator;
	
})(window);


